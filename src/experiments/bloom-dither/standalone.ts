// ============================================================
// Bloom Dither — Standalone IIFE entry for Webflow export
// Canvas2D scene + WebGL2 halftone dither, zero React deps
// ============================================================

import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

declare const __BAKED_PARAMS__: Record<string, unknown>;

const BP: Record<string, unknown> =
  typeof __BAKED_PARAMS__ !== 'undefined'
    ? __BAKED_PARAMS__
    : {
        bgColor: '#12121a',
        branchOn: true, branchScale: 1.0, branchThickness: 1.0, branchColor: '#555568',
        flowerOn: true, flowerSize: 1.0, flowerColor: '#6b4faa', petalCount: 5,
        glowOn: true, glowIntensity: 1.2, glowColor: '#aaddff', glowRadius: 1.0,
        ditherOn: true, ditherSize: 5.0,
        seed: 42.0, animSpeed: 6.0, loop: true,
      };

// ── Helpers ──────────────────────────────────────────────────

type Vec2 = [number, number];

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hex2rgb(h: string): [number, number, number] {
  if (h.charAt(0) === '#') h = h.slice(1);
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function bezierAt(a: Vec2, c: Vec2, b: Vec2, t: number): Vec2 {
  return lerp2(lerp2(a, c, t), lerp2(c, b, t), t);
}

function bezierTangent(a: Vec2, c: Vec2, b: Vec2, t: number): Vec2 {
  const s = 1 - t;
  return [2 * s * (c[0] - a[0]) + 2 * t * (b[0] - c[0]), 2 * s * (c[1] - a[1]) + 2 * t * (b[1] - c[1])];
}

function splitBezier(a: Vec2, c: Vec2, b: Vec2, t: number) {
  const ac = lerp2(a, c, t);
  const cb = lerp2(c, b, t);
  return { start: a, control: ac, end: lerp2(ac, cb, t) };
}

function ss(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ── Tree types ───────────────────────────────────────────────

interface BN { start: Vec2; end: Vec2; control: Vec2; thickness: number; depth: number; growthOrder: number; children: BN[]; flowers: FN[] }
interface FN { center: Vec2; radius: number; petalCount: number; phase: number; bloomOrder: number; colorVar: number }

function genTree(seed: number, scale: number): BN[] {
  const rng = mulberry32(Math.round(seed * 1000));
  const stems: BN[] = [];
  const n = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const side = rng();
    let o: Vec2, ba: number;
    if (side < 0.4) { o = [-0.03, 0.15 + rng() * 0.6]; ba = -0.3 + rng() * 0.6; }
    else if (side < 0.75) { o = [0.1 + rng() * 0.6, -0.03]; ba = Math.PI / 2 - 0.4 + rng() * 0.8; }
    else { o = [1.03, 0.2 + rng() * 0.5]; ba = Math.PI - 0.3 + rng() * 0.6; }
    stems.push(mkBranch(rng, o, ba + (rng() - 0.5) * 0.4, (0.25 + rng() * 0.35) * scale, 1, 0, 0, scale));
  }
  return stems;
}

function mkBranch(rng: () => number, start: Vec2, angle: number, length: number, thick: number, depth: number, pg: number, scale: number): BN {
  const end: Vec2 = [start[0] + Math.cos(angle) * length, start[1] + Math.sin(angle) * length];
  const mid = lerp2(start, end, 0.4 + rng() * 0.2);
  const perp = [-(end[1] - start[1]), end[0] - start[0]];
  const pl = Math.sqrt(perp[0] * perp[0] + perp[1] * perp[1]) || 1;
  const ctrl: Vec2 = [mid[0] + (perp[0] / pl) * length * (rng() - 0.5) * 0.3, mid[1] + (perp[1] / pl) * length * (rng() - 0.5) * 0.3];
  const go = Math.min(depth === 0 ? pg + rng() * 0.05 : pg + 0.15 + rng() * 0.1, 0.85);
  const node: BN = { start, end, control: ctrl, thickness: thick, depth, growthOrder: go, children: [], flowers: [] };
  if (depth < 3) {
    const mc = depth === 0 ? 3 + Math.floor(rng() * 3) : depth === 1 ? 2 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 2);
    for (let c = 0; c < mc; c++) {
      const t = 0.25 + rng() * 0.6;
      const fp = bezierAt(start, ctrl, end, t);
      const tan = bezierTangent(start, ctrl, end, t);
      node.children.push(mkBranch(rng, fp, Math.atan2(tan[1], tan[0]) + (rng() - 0.5) * 1.3, length * (0.3 + rng() * 0.35), thick * (depth === 0 ? 0.55 : 0.5), depth + 1, go + t * 0.15, scale));
    }
  }
  if (depth >= 1 && rng() > 0.3) node.flowers.push(mkFlower(rng, end, thick, go + 0.12));
  if (depth >= 1 && rng() > 0.5) { const ft = 0.4 + rng() * 0.4; node.flowers.push(mkFlower(rng, bezierAt(start, ctrl, end, ft), thick * 0.8, go + ft * 0.08 + 0.1)); }
  if (depth === 0 && rng() > 0.6) { const ft = 0.5 + rng() * 0.3; node.flowers.push(mkFlower(rng, bezierAt(start, ctrl, end, ft), thick * 0.7, go + ft * 0.1 + 0.15)); }
  return node;
}

function mkFlower(rng: () => number, center: Vec2, sm: number, bo: number): FN {
  return { center, radius: (0.018 + rng() * 0.018) * sm, petalCount: 5, phase: rng() * Math.PI * 2, bloomOrder: Math.min(bo, 0.9), colorVar: 0.75 + rng() * 0.5 };
}

// ── Canvas2D rendering ───────────────────────────────────────

function renderScene(ctx: CanvasRenderingContext2D, tree: BN[], progress: number, P: Record<string, unknown>) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.fillStyle = P.bgColor as string;
  ctx.fillRect(0, 0, w, h);
  const bt = (P.branchThickness as number) * h * 0.008;
  if (P.branchOn) drawBranches(ctx, tree, progress, w, h, bt, P.branchColor as string);
  if (P.flowerOn && P.glowOn) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, tree, progress, w, h, P.flowerSize as number, P.glowIntensity as number, P.glowRadius as number, hex2rgb(P.glowColor as string));
    ctx.restore();
  }
  if (P.flowerOn) drawFlowers(ctx, tree, progress, w, h, P.flowerSize as number, P.flowerColor as string);
}

function drawBranches(ctx: CanvasRenderingContext2D, nodes: BN[], progress: number, w: number, h: number, bt: number, color: string) {
  for (const n of nodes) {
    const g = ss(n.growthOrder, n.growthOrder + 0.12, progress);
    if (g <= 0) continue;
    const s: Vec2 = [n.start[0] * w, n.start[1] * h], c: Vec2 = [n.control[0] * w, n.control[1] * h], e: Vec2 = [n.end[0] * w, n.end[1] * h];
    ctx.beginPath(); ctx.moveTo(s[0], s[1]);
    if (g >= 0.99) ctx.quadraticCurveTo(c[0], c[1], e[0], e[1]);
    else { const p = splitBezier(s, c, e, g); ctx.quadraticCurveTo(p.control[0], p.control[1], p.end[0], p.end[1]); }
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(bt * n.thickness * (1 - n.depth * 0.15), 0.5); ctx.lineCap = 'round'; ctx.stroke();
    if (n.children.length) drawBranches(ctx, n.children, progress, w, h, bt, color);
  }
}

function drawFlowers(ctx: CanvasRenderingContext2D, nodes: BN[], progress: number, w: number, h: number, sm: number, baseColor: string) {
  const rgb = hex2rgb(baseColor);
  for (const n of nodes) {
    for (const fl of n.flowers) {
      const bloom = ss(fl.bloomOrder, fl.bloomOrder + 0.1, progress);
      if (bloom <= 0) continue;
      const cx = fl.center[0] * w, cy = fl.center[1] * h, r = fl.radius * h * sm * bloom;
      const rv = Math.min(1, rgb[0] * fl.colorVar), gv = Math.min(1, rgb[1] * fl.colorVar), bv = Math.min(1, rgb[2] * fl.colorVar);
      ctx.fillStyle = `rgb(${Math.round(rv * 255)},${Math.round(gv * 255)},${Math.round(bv * 255)})`;
      ctx.globalAlpha = 0.85 * bloom;
      for (let i = 0; i < fl.petalCount; i++) { const a = (i / fl.petalCount) * Math.PI * 2 + fl.phase; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4, r * 0.55, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 0.6 * bloom; ctx.fillStyle = '#1a1025'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (n.children.length) drawFlowers(ctx, n.children, progress, w, h, sm, baseColor);
  }
}

function drawGlow(ctx: CanvasRenderingContext2D, nodes: BN[], progress: number, w: number, h: number, sm: number, intensity: number, radius: number, glowRGB: [number, number, number]) {
  for (const n of nodes) {
    for (const fl of n.flowers) {
      const age = progress - fl.bloomOrder;
      if (age < 0) continue;
      const peak = Math.exp(-Math.pow(Math.max(age - 0.07, 0), 2) / 0.003);
      if (peak < 0.05) continue;
      const cx = fl.center[0] * w, cy = fl.center[1] * h, r = fl.radius * h * sm * radius * 3.5;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const gR = Math.round(glowRGB[0] * 255), gG = Math.round(glowRGB[1] * 255), gB = Math.round(glowRGB[2] * 255);
      grad.addColorStop(0, `rgba(${gR},${gG},${gB},${Math.min(peak * intensity * 0.6, 1)})`);
      grad.addColorStop(1, `rgba(${gR},${gG},${gB},0)`);
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
    if (n.children.length) drawGlow(ctx, n.children, progress, w, h, sm, intensity, radius, glowRGB);
  }
}

// ── WebGL init ───────────────────────────────────────────────

function mkShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('shader');
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); throw new Error(gl.getShaderInfoLog(s) || 'compile'); }
  return s;
}

(function () {
  const wrapper = document.querySelector('[data-webgl-experiment="bloom-dither"]');
  if (!wrapper) return;
  const canvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
  if (!gl) return;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, mkShader(gl, gl.VERTEX_SHADER, vertGLSL));
  gl.attachShader(prog, mkShader(gl, gl.FRAGMENT_SHADER, fragGLSL));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;

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

  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uScene = gl.getUniformLocation(prog, 'u_scene');
  const uDitherOn = gl.getUniformLocation(prog, 'u_ditherOn');
  const uDitherSize = gl.getUniformLocation(prog, 'u_ditherSize');
  const uBg = gl.getUniformLocation(prog, 'u_bgColor');

  // Offscreen canvas + texture
  const sc = document.createElement('canvas');
  const sctx = sc.getContext('2d')!;
  let tex: WebGLTexture | null = null;

  function initTex(w: number, h: number) {
    sc.width = w; sc.height = h;
    if (tex) gl!.deleteTexture(tex);
    tex = gl!.createTexture();
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, 1);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, sc);
    gl!.bindTexture(gl!.TEXTURE_2D, null);
  }

  function uploadTex() {
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, 1);
    gl!.texSubImage2D(gl!.TEXTURE_2D, 0, 0, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, sc);
    gl!.bindTexture(gl!.TEXTURE_2D, null);
  }

  // Generate tree
  const tree = genTree(BP.seed as number, BP.branchScale as number || 1);
  const animSpeed = (BP.animSpeed as number) || 6;
  const doLoop = BP.loop !== false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas!.getBoundingClientRect();
    canvas!.width = Math.floor(rect.width * dpr);
    canvas!.height = Math.floor(rect.height * dpr);
    gl!.viewport(0, 0, canvas!.width, canvas!.height);
    initTex(Math.ceil(canvas!.width / 2), Math.ceil(canvas!.height / 2));
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let accTime = 0, lastTime = performance.now(), lastP = -1;

  function render() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accTime += dt;

    let progress = accTime / animSpeed;
    if (doLoop) progress = progress % 1.0;
    else progress = Math.min(progress, 1.0);

    if (Math.abs(progress - lastP) > 0.0005) {
      renderScene(sctx, tree, progress, BP);
      uploadTex();
      lastP = progress;
    }

    gl!.useProgram(prog);
    gl!.uniform2f(uRes, canvas!.width, canvas!.height);
    gl!.uniform1f(uDitherOn, BP.ditherOn !== false ? 1.0 : 0.0);
    gl!.uniform1f(uDitherSize, (BP.ditherSize as number) || 5);
    const bg = hex2rgb((BP.bgColor as string) || '#12121a');
    gl!.uniform3f(uBg, bg[0], bg[1], bg[2]);

    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.uniform1i(uScene, 0);

    gl!.bindVertexArray(vao);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    gl!.bindVertexArray(null);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
