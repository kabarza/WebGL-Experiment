// ============================================================
// Bloom Dither — Canvas2D scene + WebGL halftone dither
// ============================================================

import type {
  Experiment,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { FullscreenQuadGL } from '../../core/FullscreenQuadGL.ts';
import { meta } from './meta.ts';
import { controls } from './params.ts';
import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

// ── Seeded PRNG (mulberry32) ─────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Data types ───────────────────────────────────────────────

type Vec2 = [number, number];

interface BranchNode {
  start: Vec2;
  end: Vec2;
  control: Vec2;
  thickness: number;
  depth: number;
  growthOrder: number;
  children: BranchNode[];
  flowers: FlowerNode[];
}

interface FlowerNode {
  center: Vec2;
  radius: number;
  petalCount: number;
  phase: number;
  bloomOrder: number;
  colorVar: number;
}

// ── Bezier helpers ───────────────────────────────────────────

function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function bezierAt(a: Vec2, c: Vec2, b: Vec2, t: number): Vec2 {
  const ac = lerp2(a, c, t);
  const cb = lerp2(c, b, t);
  return lerp2(ac, cb, t);
}

function bezierTangent(a: Vec2, c: Vec2, b: Vec2, t: number): Vec2 {
  // derivative of quadratic bezier: 2(1-t)(c-a) + 2t(b-c)
  const s = 1 - t;
  return [
    2 * s * (c[0] - a[0]) + 2 * t * (b[0] - c[0]),
    2 * s * (c[1] - a[1]) + 2 * t * (b[1] - c[1]),
  ];
}

/** Split a quadratic Bezier at t, return the first half's control points */
function splitBezier(
  a: Vec2, c: Vec2, b: Vec2, t: number,
): { start: Vec2; control: Vec2; end: Vec2 } {
  const ac = lerp2(a, c, t);
  const cb = lerp2(c, b, t);
  const mid = lerp2(ac, cb, t);
  return { start: a, control: ac, end: mid };
}

// ── Tree generation ──────────────────────────────────────────

function generateTree(seed: number, branchScale: number): BranchNode[] {
  const rng = mulberry32(Math.round(seed * 1000));
  const stems: BranchNode[] = [];
  const stemCount = 4 + Math.floor(rng() * 3); // 4-6

  for (let i = 0; i < stemCount; i++) {
    const side = rng();
    let origin: Vec2;
    let baseAngle: number;

    if (side < 0.4) {
      // Left edge
      origin = [-0.03, 0.15 + rng() * 0.6];
      baseAngle = -0.3 + rng() * 0.6;
    } else if (side < 0.75) {
      // Bottom edge
      origin = [0.1 + rng() * 0.6, -0.03];
      baseAngle = Math.PI / 2 - 0.4 + rng() * 0.8;
    } else {
      // Right edge
      origin = [1.03, 0.2 + rng() * 0.5];
      baseAngle = Math.PI - 0.3 + rng() * 0.6;
    }

    const angle = baseAngle + (rng() - 0.5) * 0.4;
    const len = (0.25 + rng() * 0.35) * branchScale;

    const stem = buildBranch(rng, origin, angle, len, 1.0, 0, 0, branchScale);
    stems.push(stem);
  }

  return stems;
}

function buildBranch(
  rng: () => number,
  start: Vec2,
  angle: number,
  length: number,
  thickMul: number,
  depth: number,
  parentGrowth: number,
  branchScale: number,
): BranchNode {
  const end: Vec2 = [
    start[0] + Math.cos(angle) * length,
    start[1] + Math.sin(angle) * length,
  ];

  // Control point — offset from midpoint for curvature
  const mid = lerp2(start, end, 0.4 + rng() * 0.2);
  const perp = [-(end[1] - start[1]), end[0] - start[0]];
  const pLen = Math.sqrt(perp[0] * perp[0] + perp[1] * perp[1]) || 1;
  const control: Vec2 = [
    mid[0] + (perp[0] / pLen) * length * (rng() - 0.5) * 0.3,
    mid[1] + (perp[1] / pLen) * length * (rng() - 0.5) * 0.3,
  ];

  const growthOrder = depth === 0
    ? parentGrowth + rng() * 0.05
    : parentGrowth + 0.15 + rng() * 0.1;

  const node: BranchNode = {
    start, end, control,
    thickness: thickMul,
    depth,
    growthOrder: Math.min(growthOrder, 0.85),
    children: [],
    flowers: [],
  };

  // Sub-branches
  if (depth < 3) {
    const maxChildren = depth === 0 ? 3 + Math.floor(rng() * 3)
      : depth === 1 ? 2 + Math.floor(rng() * 2)
        : 1 + Math.floor(rng() * 2);

    for (let c = 0; c < maxChildren; c++) {
      const t = 0.25 + rng() * 0.6;
      const forkPt = bezierAt(start, control, end, t);
      const tan = bezierTangent(start, control, end, t);
      const tanAngle = Math.atan2(tan[1], tan[0]);
      const forkAngle = tanAngle + (rng() - 0.5) * 1.3;
      const childLen = length * (0.3 + rng() * 0.35);
      const childThick = thickMul * (depth === 0 ? 0.55 : 0.5);
      const childGrowth = growthOrder + t * 0.15;

      node.children.push(
        buildBranch(rng, forkPt, forkAngle, childLen, childThick, depth + 1, childGrowth, branchScale),
      );
    }
  }

  // Flowers at tip and along the branch
  if (depth >= 1) {
    if (rng() > 0.3) {
      node.flowers.push(makeFlower(rng, end, thickMul, growthOrder + 0.12, 5));
    }
    if (rng() > 0.5) {
      const ft = 0.4 + rng() * 0.4;
      const fp = bezierAt(start, control, end, ft);
      node.flowers.push(makeFlower(rng, fp, thickMul * 0.8, growthOrder + ft * 0.08 + 0.1, 5));
    }
  }
  // Occasional flower on main stem
  if (depth === 0 && rng() > 0.6) {
    const ft = 0.5 + rng() * 0.3;
    const fp = bezierAt(start, control, end, ft);
    node.flowers.push(makeFlower(rng, fp, thickMul * 0.7, growthOrder + ft * 0.1 + 0.15, 5));
  }

  return node;
}

function makeFlower(
  rng: () => number, center: Vec2, sizeMul: number, bloomOrder: number, petalCount: number,
): FlowerNode {
  return {
    center,
    radius: (0.018 + rng() * 0.018) * sizeMul,
    petalCount,
    phase: rng() * Math.PI * 2,
    bloomOrder: Math.min(bloomOrder, 0.9),
    colorVar: 0.75 + rng() * 0.5,
  };
}

// ── Canvas2D scene rendering ─────────────────────────────────

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hex2rgb(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  ];
}

function renderScene(
  ctx: CanvasRenderingContext2D,
  tree: BranchNode[],
  progress: number,
  P: Record<string, unknown>,
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // Clear to background
  ctx.fillStyle = P.bgColor as string;
  ctx.fillRect(0, 0, w, h);

  const baseThick = (P.branchThickness as number) * h * 0.008;
  const flowerSize = P.flowerSize as number;
  const flowerColor = P.flowerColor as string;
  const branchColor = P.branchColor as string;
  const glowOn = P.glowOn as boolean;
  const glowIntensity = P.glowIntensity as number;
  const glowRadius = P.glowRadius as number;
  const glowRGB = hex2rgb(P.glowColor as string);

  // Draw branches (sorted by depth — stems first so they appear behind)
  if (P.branchOn) {
    drawBranches(ctx, tree, progress, w, h, baseThick, branchColor);
  }

  // Draw glow (additive, before flowers so it sits underneath petals)
  if (P.flowerOn && glowOn) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, tree, progress, w, h, flowerSize, glowIntensity, glowRadius, glowRGB);
    ctx.restore();
  }

  // Draw flowers
  if (P.flowerOn) {
    drawFlowers(ctx, tree, progress, w, h, flowerSize, flowerColor);
  }
}

function drawBranches(
  ctx: CanvasRenderingContext2D,
  nodes: BranchNode[],
  progress: number,
  w: number, h: number,
  baseThick: number,
  color: string,
) {
  for (const node of nodes) {
    const growth = smoothstep(node.growthOrder, node.growthOrder + 0.12, progress);
    if (growth <= 0) continue;

    const s: Vec2 = [node.start[0] * w, node.start[1] * h];
    const c: Vec2 = [node.control[0] * w, node.control[1] * h];
    const e: Vec2 = [node.end[0] * w, node.end[1] * h];

    ctx.beginPath();
    ctx.moveTo(s[0], s[1]);

    if (growth >= 0.99) {
      ctx.quadraticCurveTo(c[0], c[1], e[0], e[1]);
    } else {
      const partial = splitBezier(s, c, e, growth);
      ctx.quadraticCurveTo(partial.control[0], partial.control[1], partial.end[0], partial.end[1]);
    }

    const thick = baseThick * node.thickness * (1.0 - node.depth * 0.15);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(thick, 0.5);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Recurse into children
    if (node.children.length > 0) {
      drawBranches(ctx, node.children, progress, w, h, baseThick, color);
    }
  }
}

function drawFlowers(
  ctx: CanvasRenderingContext2D,
  nodes: BranchNode[],
  progress: number,
  w: number, h: number,
  sizeMul: number,
  baseColor: string,
) {
  const rgb = hex2rgb(baseColor);

  for (const node of nodes) {
    for (const fl of node.flowers) {
      const bloom = smoothstep(fl.bloomOrder, fl.bloomOrder + 0.1, progress);
      if (bloom <= 0) continue;

      const cx = fl.center[0] * w;
      const cy = fl.center[1] * h;
      const r = fl.radius * h * sizeMul * bloom;

      // Petals — overlapping circles in a ring
      const nr = Math.round(fl.petalCount);
      const petalR = r * 0.55;
      const ringR = r * 0.4;

      // Per-flower color variation
      const rv = Math.min(1, rgb[0] * fl.colorVar);
      const gv = Math.min(1, rgb[1] * fl.colorVar);
      const bv = Math.min(1, rgb[2] * fl.colorVar);
      const col = `rgb(${Math.round(rv * 255)},${Math.round(gv * 255)},${Math.round(bv * 255)})`;

      ctx.fillStyle = col;
      ctx.globalAlpha = 0.85 * bloom;

      for (let i = 0; i < nr; i++) {
        const a = (i / nr) * Math.PI * 2 + fl.phase;
        const px = cx + Math.cos(a) * ringR;
        const py = cy + Math.sin(a) * ringR;
        ctx.beginPath();
        ctx.arc(px, py, petalR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Center (dark)
      ctx.globalAlpha = 0.6 * bloom;
      ctx.fillStyle = '#1a1025';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
    }

    // Recurse
    if (node.children.length > 0) {
      drawFlowers(ctx, node.children, progress, w, h, sizeMul, baseColor);
    }
  }
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  nodes: BranchNode[],
  progress: number,
  w: number, h: number,
  sizeMul: number,
  intensity: number,
  radius: number,
  glowRGB: [number, number, number],
) {
  for (const node of nodes) {
    for (const fl of node.flowers) {
      const age = progress - fl.bloomOrder;
      if (age < 0) continue;
      const peak = Math.exp(-Math.pow(Math.max(age - 0.07, 0), 2) / 0.003);
      if (peak < 0.05) continue;

      const cx = fl.center[0] * w;
      const cy = fl.center[1] * h;
      const r = fl.radius * h * sizeMul * radius * 3.5;
      const alpha = peak * intensity * 0.6;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const gR = Math.round(glowRGB[0] * 255);
      const gG = Math.round(glowRGB[1] * 255);
      const gB = Math.round(glowRGB[2] * 255);
      grad.addColorStop(0, `rgba(${gR},${gG},${gB},${Math.min(alpha, 1)})`);
      grad.addColorStop(1, `rgba(${gR},${gG},${gB},0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (node.children.length > 0) {
      drawGlow(ctx, node.children, progress, w, h, sizeMul, intensity, radius, glowRGB);
    }
  }
}

// ── WebGL shader setup ───────────────────────────────────────

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

// ── Experiment init ──────────────────────────────────────────

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { gl, canvas, params } = ctx;

  // Shader program
  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create program');
  gl.attachShader(prog, mkShader(gl, gl.VERTEX_SHADER, vertGLSL));
  gl.attachShader(prog, mkShader(gl, gl.FRAGMENT_SHADER, fragGLSL));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
  }

  const quad = new FullscreenQuadGL(gl);

  // Uniform locations
  const uResolution = gl.getUniformLocation(prog, 'u_resolution');
  const uScene = gl.getUniformLocation(prog, 'u_scene');
  const uDitherOn = gl.getUniformLocation(prog, 'u_ditherOn');
  const uDitherSize = gl.getUniformLocation(prog, 'u_ditherSize');
  const uBgColor = gl.getUniformLocation(prog, 'u_bgColor');

  // Offscreen scene canvas
  const sceneCanvas = document.createElement('canvas');
  const sceneCtx = sceneCanvas.getContext('2d')!;

  // Scene texture
  let sceneTexture: WebGLTexture | null = null;
  let texW = 0;
  let texH = 0;

  function initTexture(w: number, h: number) {
    sceneCanvas.width = w;
    sceneCanvas.height = h;
    if (sceneTexture) gl.deleteTexture(sceneTexture);
    sceneTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sceneCanvas);
    gl.bindTexture(gl.TEXTURE_2D, null);
    texW = w;
    texH = h;
  }

  function uploadTexture() {
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, sceneCanvas);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  // Tree state
  let tree: BranchNode[] = [];
  let lastSeed = -1;
  let lastProgress = -1;
  let lastParamHash = '';

  function rebuildTree(P: Record<string, unknown>) {
    const seed = P.seed as number;
    if (seed !== lastSeed) {
      tree = generateTree(seed, P.branchScale as number);
      lastSeed = seed;
      lastProgress = -1; // force re-render
    }
  }

  function paramHash(P: Record<string, unknown>): string {
    return `${P.branchOn}|${P.branchThickness}|${P.branchColor}|${P.flowerOn}|${P.flowerSize}|${P.flowerColor}|${P.petalCount}|${P.glowOn}|${P.glowIntensity}|${P.glowColor}|${P.glowRadius}|${P.bgColor}|${P.branchScale}`;
  }

  // Animation state
  let autoProgress = 0;

  // Initial texture + tree
  const halfW = Math.ceil(canvas.width / 2);
  const halfH = Math.ceil(canvas.height / 2);
  initTexture(halfW, halfH);
  rebuildTree(params);

  return {
    render(_time: number, deltaTime: number) {
      const P = params;

      // Rebuild tree if seed or branchScale changed
      const newSeed = P.seed as number;
      const newScale = P.branchScale as number;
      if (newSeed !== lastSeed) {
        tree = generateTree(newSeed, newScale);
        lastSeed = newSeed;
        lastProgress = -1;
      }

      // Compute effective progress
      let effectiveProgress: number;
      if (P.playMode === 'Auto Play') {
        const duration = Math.max(P.animSpeed as number, 0.1);
        autoProgress += deltaTime / duration;
        if (autoProgress >= 1.0) {
          autoProgress = P.loop ? autoProgress % 1.0 : 1.0;
        }
        effectiveProgress = autoProgress;
      } else {
        effectiveProgress = P.progress as number;
        autoProgress = effectiveProgress;
      }

      // Re-render scene if anything changed
      const ph = paramHash(P);
      if (Math.abs(effectiveProgress - lastProgress) > 0.0005 || ph !== lastParamHash) {
        renderScene(sceneCtx, tree, effectiveProgress, P);
        uploadTexture();
        lastProgress = effectiveProgress;
        lastParamHash = ph;
      }

      // Draw dither shader
      gl.useProgram(prog);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uDitherOn, P.ditherOn ? 1.0 : 0.0);
      gl.uniform1f(uDitherSize, P.ditherSize as number);
      const bg = hex2rgb(P.bgColor as string);
      gl.uniform3f(uBgColor, bg[0], bg[1], bg[2]);

      // Bind scene texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
      gl.uniform1i(uScene, 0);

      quad.bind(prog);
      quad.draw();
    },

    resize(_w: number, _h: number, _dpr: number) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      const halfW = Math.ceil(canvas.width / 2);
      const halfH = Math.ceil(canvas.height / 2);
      if (halfW !== texW || halfH !== texH) {
        initTexture(halfW, halfH);
        lastProgress = -1; // force re-render
      }
    },

    dispose() {
      gl.deleteProgram(prog);
      if (sceneTexture) gl.deleteTexture(sceneTexture);
      quad.dispose();
    },
  };
}

export const bloomDitherExperiment: Experiment = {
  meta,
  controls,
  initGL,
};
