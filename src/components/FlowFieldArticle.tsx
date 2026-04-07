// ============================================================
// FlowFieldArticle — Rich technical deep-dive on the shader
// ============================================================

import { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { useChrome } from './ChromeContext.tsx';

/* ── Code block helper ─────────────────────────────── */

function CodeBlock({ code, caption }: { code: string; caption?: string }) {
  const lines = code.replace(/^\n+|\n+$/g, '').split('\n');
  return (
    <figure className="article-code-figure">
      {caption && <figcaption className="article-code-caption">{caption}</figcaption>}
      <pre className="article-code-block">
        <code>
          {lines.map((line, i) => (
            <div key={i} className="code-line">
              <span className="code-line-number">{i + 1}</span>
              <span className="code-line-content">{line}</span>
            </div>
          ))}
        </code>
      </pre>
    </figure>
  );
}

/* ── SVG Diagrams ──────────────────────────────────── */

function PipelineDiagram() {
  const stages = [
    { label: 'UV Coordinates', desc: 'Screen position to 0..1' },
    { label: 'Camera Transform', desc: 'Rotation + zoom' },
    { label: 'Noise + FBM', desc: 'Base noise pattern' },
    { label: 'Domain Warping', desc: 'Core technique', highlight: true },
    { label: 'Mouse Interaction', desc: 'Cursor displacement' },
    { label: 'Color Mapping', desc: '4-color sin blend' },
    { label: 'Highlights & Folds', desc: 'Edge detection' },
    { label: 'Vignette', desc: 'Edge fade' },
    { label: 'Post-Processing', desc: 'Saturation, contrast, grain' },
    { label: 'Output', desc: 'gl_FragColor' },
  ];

  const stepH = 42;
  const startY = 14;
  const h = startY + stages.length * stepH;

  return (
    <svg viewBox={`0 0 400 ${h}`} fill="none" role="img" aria-label="Shader pipeline stages" style={{ maxWidth: 420 }}>
      {stages.map((s, i) => {
        const y = startY + i * stepH;
        const hl = (s as { highlight?: boolean }).highlight;
        return (
          <g key={i}>
            <circle
              cx="8" cy={y} r={hl ? 5.5 : 4}
              fill={hl ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)'}
              stroke={hl ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}
              strokeWidth="1"
            />
            {hl && <circle cx="8" cy={y} r="2" fill="rgba(255,255,255,0.5)" />}
            <text x="26" y={y + 5} fill={hl ? '#e8e8e8' : 'rgba(255,255,255,0.7)'} fontSize="14" fontWeight={hl ? '600' : '400'} style={{ fontFamily: 'var(--font-body)' }}>
              {s.label}
            </text>
            <text x="26" y={y + 20} fill="rgba(255,255,255,0.25)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
              {s.desc}
            </text>
            {i < stages.length - 1 && (
              <line x1="8" y1={y + (hl ? 7 : 5)} x2="8" y2={y + stepH - 5} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function FbmDiagram() {
  const w = 500, h = 290, pts = 120, padX = 50, drawW = w - padX * 2;
  const wave = (i: number, freq: number, amp: number, phase: number) =>
    Math.sin(i * freq * 0.08 + phase) * amp;

  const makePath = (fn: (i: number) => number, yBase: number) => {
    const d: string[] = [];
    for (let i = 0; i <= pts; i++) {
      const x = padX + (i / pts) * drawW;
      const y = yBase + fn(i);
      d.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return d.join(' ');
  };

  const oct1 = (i: number) => wave(i, 1, 22, 0);
  const oct2 = (i: number) => wave(i, 1.9, 11, 1.3);
  const oct3 = (i: number) => wave(i, 3.61, 5.3, 2.1);
  const combined = (i: number) => (oct1(i) + oct2(i) + oct3(i)) * 0.8;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} fill="none" role="img" aria-label="FBM octave stacking diagram">
      {/* Octave labels and waves */}
      <text x="12" y="48" fill="#555" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>oct 1</text>
      <text x={w - 12} y="48" textAnchor="end" fill="rgba(255,255,255,0.15)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>amp=0.55 freq=1.0</text>
      <path d={makePath(oct1, 45)} stroke="rgba(123,76,192,0.55)" strokeWidth="1.5" />

      <text x={w / 2} y="78" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="16">+</text>

      <text x="12" y="108" fill="#555" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>oct 2</text>
      <text x={w - 12} y="108" textAnchor="end" fill="rgba(255,255,255,0.15)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>amp=0.26 freq=1.9</text>
      <path d={makePath(oct2, 105)} stroke="rgba(123,76,192,0.4)" strokeWidth="1.5" />

      <text x={w / 2} y="138" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="16">+</text>

      <text x="12" y="168" fill="#555" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>oct 3</text>
      <text x={w - 12} y="168" textAnchor="end" fill="rgba(255,255,255,0.15)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>amp=0.13 freq=3.6</text>
      <path d={makePath(oct3, 165)} stroke="rgba(123,76,192,0.25)" strokeWidth="1.5" />

      {/* Separator */}
      <line x1={padX} y1="198" x2={w - padX} y2="198" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <text x={w / 2} y="195" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="13">=</text>

      {/* Combined */}
      <text x="12" y="240" fill="#999" fontSize="10" fontWeight="600" style={{ fontFamily: 'var(--font-mono)' }}>fbm</text>
      <path d={makePath(combined, 237)} stroke="rgba(212,160,232,0.7)" strokeWidth="2" />
    </svg>
  );
}

function DomainWarpDiagram() {
  const gridN = 7, cell = 26, dotR = 2.5;
  const gridW = (gridN - 1) * cell;
  const lx = 30, rx = 290, ty = 46;

  // Pre-computed offsets that look organic
  const offsets = [
    [2,-1],[4,2],[1,3],[-2,2],[3,-2],[-1,1],[0,-3],
    [-3,4],[5,0],[-2,5],[6,1],[-4,3],[2,-5],[-3,0],
    [1,6],[-5,-2],[7,4],[-1,-6],[4,7],[-6,2],[3,-4],
    [-4,-3],[6,5],[-7,-1],[5,-7],[-2,6],[7,-3],[-5,4],
    [3,-5],[-6,3],[4,-2],[-3,7],[6,-4],[-2,-6],[5,3],
    [-1,5],[7,-6],[-4,2],[2,6],[-7,-4],[3,5],[-5,-2],
    [5,-3],[-2,4],[6,-5],[-4,-3],[1,7],[-6,2],[4,-1],
  ];

  const w = 500, h = gridW + ty + 20;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} fill="none" role="img" aria-label="Domain warping comparison">
      <text x={lx + gridW / 2} y="18" textAnchor="middle" fill="#888" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        Standard sampling
      </text>
      <text x={rx + gridW / 2} y="18" textAnchor="middle" fill="#888" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        Domain-warped
      </text>

      {/* Regular grid */}
      {Array.from({ length: gridN * gridN }, (_, idx) => {
        const row = Math.floor(idx / gridN), col = idx % gridN;
        return (
          <circle key={`r${idx}`} cx={lx + col * cell} cy={ty + row * cell} r={dotR} fill="rgba(255,255,255,0.2)" />
        );
      })}

      {/* Arrow */}
      <line x1={lx + gridW + 16} y1={ty + gridW / 2} x2={rx - 16} y2={ty + gridW / 2} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <polygon points={`${rx - 20},${ty + gridW / 2 - 3.5} ${rx - 12},${ty + gridW / 2} ${rx - 20},${ty + gridW / 2 + 3.5}`} fill="rgba(255,255,255,0.12)" />
      <text x={(lx + gridW + rx) / 2 + 6} y={ty + gridW / 2 - 10} textAnchor="middle" fill="rgba(123,76,192,0.5)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>
        + noise(p)
      </text>

      {/* Warped grid */}
      {Array.from({ length: gridN * gridN }, (_, idx) => {
        const row = Math.floor(idx / gridN), col = idx % gridN;
        const [dx, dy] = offsets[idx] || [0, 0];
        return (
          <circle key={`w${idx}`} cx={rx + col * cell + dx} cy={ty + row * cell + dy} r={dotR} fill="rgba(123,76,192,0.5)" />
        );
      })}
    </svg>
  );
}

function ColorMixDiagram() {
  return (
    <svg viewBox="0 0 460 270" fill="none" role="img" aria-label="4-color mixing diagram">
      {/* Input colors */}
      <rect x="30" y="16" width="56" height="28" rx="6" fill="#492d7b" />
      <text x="58" y="62" textAnchor="middle" fill="#666" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>col1</text>

      <rect x="106" y="16" width="56" height="28" rx="6" fill="#8c5a1c" />
      <text x="134" y="62" textAnchor="middle" fill="#666" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>col2</text>

      <rect x="268" y="16" width="56" height="28" rx="6" fill="#381630" />
      <text x="296" y="62" textAnchor="middle" fill="#666" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>col3</text>

      <rect x="344" y="16" width="56" height="28" rx="6" fill="#7b4cc0" />
      <text x="372" y="62" textAnchor="middle" fill="#666" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>col4</text>

      {/* Mix A */}
      <line x1="58" y1="44" x2="96" y2="96" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <line x1="134" y1="44" x2="96" y2="96" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <text x="96" y="88" textAnchor="middle" fill="rgba(123,76,192,0.45)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>mix(v1)</text>
      <rect x="66" y="96" width="60" height="26" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" />
      <text x="96" y="113" textAnchor="middle" fill="#777" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>mixA</text>

      {/* Mix B */}
      <line x1="296" y1="44" x2="334" y2="96" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <line x1="372" y1="44" x2="334" y2="96" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <text x="334" y="88" textAnchor="middle" fill="rgba(123,76,192,0.45)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>mix(v1)</text>
      <rect x="304" y="96" width="60" height="26" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" />
      <text x="334" y="113" textAnchor="middle" fill="#777" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>mixB</text>

      {/* Final mix */}
      <line x1="96" y1="122" x2="215" y2="176" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <line x1="334" y1="122" x2="215" y2="176" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <text x="215" y="170" textAnchor="middle" fill="rgba(123,76,192,0.45)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>mix(v2)</text>

      <defs>
        <linearGradient id="finalMix" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#492d7b" />
          <stop offset="40%" stopColor="#8c5a1c" />
          <stop offset="100%" stopColor="#7b4cc0" />
        </linearGradient>
      </defs>
      <rect x="175" y="180" width="80" height="36" rx="8" fill="url(#finalMix)" stroke="rgba(123,76,192,0.3)" strokeWidth="1" />
      <text x="215" y="236" textAnchor="middle" fill="#888" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>final color</text>
    </svg>
  );
}

function MouseDiagram() {
  return (
    <svg viewBox="0 0 400 220" fill="none" role="img" aria-label="Mouse influence radius">
      {/* Outer ring — softness boundary */}
      <circle cx="160" cy="110" r="80" stroke="rgba(123,76,192,0.15)" strokeWidth="1" strokeDasharray="4 4" />
      <circle cx="160" cy="110" r="55" stroke="rgba(123,76,192,0.3)" strokeWidth="1" strokeDasharray="4 4" />
      {/* Gradient fill for influence */}
      <defs>
        <radialGradient id="mouseGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(123,76,192,0.2)" />
          <stop offset="60%" stopColor="rgba(123,76,192,0.06)" />
          <stop offset="100%" stopColor="rgba(123,76,192,0)" />
        </radialGradient>
      </defs>
      <circle cx="160" cy="110" r="80" fill="url(#mouseGrad)" />
      {/* Cursor dot */}
      <circle cx="160" cy="110" r="4" fill="#7b4cc0" />
      <circle cx="160" cy="110" r="8" fill="none" stroke="rgba(123,76,192,0.4)" strokeWidth="1" />
      {/* Trail dot — lagging behind */}
      <circle cx="130" cy="125" r="3" fill="rgba(123,76,192,0.3)" />
      <line x1="133" y1="123" x2="157" y2="112" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />
      {/* Labels */}
      <text x="160" y="14" textAnchor="middle" fill="#666" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>smoothstep falloff</text>
      <text x="282" y="113" fill="#555" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>mouseRadius</text>
      <line x1="162" y1="110" x2="238" y2="110" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <text x="120" y="142" fill="rgba(123,76,192,0.4)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>trail</text>
      <text x="168" y="100" fill="rgba(123,76,192,0.5)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>cursor</text>
    </svg>
  );
}

/* ── Code snippets ─────────────────────────────────── */

const CODE_VERTEX = `attribute vec2 a_pos;
varying vec2 vUv;

void main() {
  vUv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const CODE_COORDS = `void main() {
  vec2 uv = vUv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 st = vec2(uv.x * aspect, uv.y);
  float t = u_time;

  // Camera: rotation + zoom applied to coordinates
  vec2 center = vec2(aspect * 0.5, 0.5);
  vec2 centered = st - center;
  centered = rot2d(centered, u_rotation);
  centered /= u_zoom;
  st = centered + center;`;

const CODE_SNOISE_SHORT = `float snoise(vec3 v) {
  // Skew input space to simplex grid
  vec3 i = floor(v + dot(v, vec3(1.0/3.0)));
  vec3 x0 = v - i + dot(i, vec3(1.0/6.0));

  // Find 4 corners of simplex tetrahedron
  // Compute gradients at each corner
  // Weight contributions by distance

  // ...40 lines of permutation + gradient math...

  // Final: smooth, continuous value in [-1, 1]
  return 42.0 * dot(m*m, vec4(dot(p0,x0), ...));
}`;

const CODE_FBM = `float fbm(vec3 p) {
  float val = 0.0, amp = 0.55, freq = 1.0;
  int oct = int(u_noiseOctaves);
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    val += amp * snoise(p * freq);
    freq *= 1.9;   // each octave: higher frequency
    amp  *= 0.48;  // each octave: lower amplitude
  }
  return val;
}`;

const CODE_WARP = `// Noise + flow field (domain warping)
vec2 p = st * u_noiseScale;
float ft = t * u_warpSpeed;

// First warp layer: sample noise at two offset positions
float q1 = fbm(vec3(p * u_warpScale, ft * 0.6));
float q2 = fbm(vec3((p + vec2(5.2, 1.3)) * u_warpScale, ft * 0.55 + 10.0));

vec2 wP = p;
if (u_warpDepth >= 1.0) {
  wP = p + u_warpStrength * vec2(q1, q2);
}

// Second + third warp layers (only computed when needed)
if (u_warpDepth >= 2.0) {
  float r1 = fbm(vec3((wP + vec2(1.7, 9.2)) * u_warpScale, ft * 0.45));
  float r2 = fbm(vec3((wP + vec2(8.3, 2.8)) * u_warpScale, ft * 0.5));
  wP = p + u_warpStrength * vec2(r1, r2);

  if (u_warpDepth >= 3.0) {
    float s1 = fbm(vec3((wP + vec2(3.1, 7.7)) * u_warpScale, ft * 0.4));
    float s2 = fbm(vec3((wP + vec2(6.5, 4.2)) * u_warpScale, ft * 0.42));
    wP = p + u_warpStrength * vec2(s1, s2);
  }
}`;

const CODE_MOUSE = `// Mouse: inject noise-driven warp near cursor
if (u_mouseStr > 0.0) {
  float mTime = t * 0.2 + 42.0;
  float mw1 = snoise(vec3(st * u_warpScale * 1.3 + vec2(17.3, 5.7), mTime));
  float mw2 = snoise(vec3(st * u_warpScale * 1.3 + vec2(3.1, 14.2), mTime * 0.9 + 35.0));
  wP += vec2(mw1, mw2) * mouseProx * u_mouseStr;
  wP += (cursorPos - trailMPos) * mInfluence * u_mouseVel * 0.5;
}`;

const CODE_MOUSE_INFLUENCE = `vec2 cursorPos = vec2(u_mousePos.x * aspect, u_mousePos.y);
vec2 trailMPos = vec2(u_mouseTrailPos.x * aspect, u_mouseTrailPos.y);

float mDist = length(st - cursorPos);
float mInfluence = 1.0 - smoothstep(
  u_mouseRadius - u_mouseSoftness,
  u_mouseRadius + u_mouseSoftness,
  mDist
);

float tDist = length(st - trailMPos);
float trailR = u_mouseRadius * 0.7;
float tInfluence = (1.0 - smoothstep(
  trailR - u_mouseSoftness * 0.8,
  trailR + u_mouseSoftness * 0.8,
  tDist
)) * u_mouseTrailStr;

float mouseProx = max(mInfluence, tInfluence);`;

const CODE_COLOR = `const float TAU = 6.28318530718;
float timeShift = u_colorShift * t * 0.012;

// Noise values -> smooth oscillating blend factors
float v1 = sin(n1 * TAU * u_blendWidth * 0.5 + timeShift) * 0.5 + 0.5;
float v2 = sin(n2 * TAU * u_blendWidth * 0.5 + timeShift * 0.8 + 1.5708) * 0.5 + 0.5;
float v3 = sin(n3 * TAU * u_blendWidth * 0.4 + timeShift * 0.5) * 0.5 + 0.5;

// Two-stage color blending
vec3 mixA = mix(u_col1, u_col2, v1);
vec3 mixB = mix(u_col3, u_col4, v1);
vec3 color = mix(mixA, mixB, v2);

// Subtle accent from warp field averages
vec3 accent = mix(u_col2, u_col3, 0.5);
color = mix(color, accent, v3 * 0.15);`;

const CODE_HIGHLIGHTS = `// Detect "folds" where different noise values diverge
float fold = abs(n1 - n2);
fold = pow(fold, 0.6);          // sharpen the edge
float foldQ = abs(q1 - q2);
foldQ = pow(foldQ, 0.7);        // slightly sharper
float totalFold = max(fold, foldQ);
color = mix(color, u_highlightColor, totalFold * u_highlightStr);`;

const CODE_VIGNETTE = `// Rounded rectangle SDF vignette (aspect-independent)
vec2 vigP = uv * 2.0 - 1.0;         // -1 at edges, 0 at center

// Corner radius: vignetteRound (0..100) controls roundness
// 0 = sharp rectangle, 100 = fully circular
float cr = (u_vignetteRound / 100.0) * u_vignetteRadius;

// Signed distance to the rounded rectangle boundary
vec2 q = abs(vigP) - vec2(u_vignetteRadius) + cr;
float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - cr;

// Smooth falloff: inside (d<0) = 1, outside (d>0) = 0
float vignette = 1.0 - smoothstep(-u_vignetteSoft, u_vignetteSoft, d);

// Blend: background at edges, computed color in center
color = mix(u_bgColor, color, vignette);`;

const CODE_POST = `// Saturation: blend between grayscale and color
float luma = dot(color, vec3(0.299, 0.587, 0.114));
color = mix(vec3(luma), color, u_saturation);

// Brightness + Contrast
color *= u_brightness;
color = (color - 0.5) * u_contrast + 0.5;

// Film grain: three hash functions, averaged
float grainT = floor(u_time * u_grainSpeed);
vec2 gUV = vUv * u_resolution / u_grainScale;
float g1 = hash21(gUV + grainT * 17.13);
float g2 = hash31(vec3(gUV * 1.37, grainT * 23.71));
float g3 = hash21(gUV.yx * 0.97 + grainT * 31.57 + 100.0);
float grain = ((g1 + g2 + g3) / 3.0 - 0.5) * u_grainAmt;
color += grain;

color = clamp(color, 0.0, 1.0);
gl_FragColor = vec4(color, 1.0);`;

const CODE_UNIFORMS = `// Every frame, JavaScript writes params to the GPU
function updateUniforms(time: number): void {
  const P = params;  // live values from the control panel

  uniforms.set('time', time);
  uniforms.set('resolution', [width, height]);

  // Mouse trail: exponentially smoothed position
  trailX += (input.mouse.x - trailX) * P.mouseTrailSmoothing;
  trailY += (input.mouse.y - trailY) * P.mouseTrailSmoothing;

  uniforms.set('mousePos', [input.mouse.x, input.mouse.y]);
  uniforms.set('mouseTrailPos', [trailX, trailY]);

  // Colors: convert hex strings to RGB floats
  uniforms.set('col1', hex2rgb(P.color1));  // '#492d7b' -> [0.286, 0.176, 0.482]
  uniforms.set('col2', hex2rgb(P.color2));

  // ... all other uniforms ...

  uniforms.upload(device);  // write buffer to GPU
}`;

const CODE_HASH = `// Hash functions — pseudo-random, no visible patterns
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}`;

/* ── TOC sections ──────────────────────────────────── */

export const TOC_SECTIONS = [
  { id: 'overview', label: 'The Big Picture' },
  { id: 'canvas', label: 'Fullscreen Quad' },
  { id: 'coordinates', label: 'Coordinate Space' },
  { id: 'noise', label: 'Noise Foundation' },
  { id: 'fbm', label: 'FBM' },
  { id: 'domain-warp', label: 'Domain Warping' },
  { id: 'mouse', label: 'Mouse Interaction' },
  { id: 'color', label: 'Color Mapping' },
  { id: 'highlights', label: 'Highlights & Folds' },
  { id: 'vignette', label: 'Vignette' },
  { id: 'post-processing', label: 'Post-Processing' },
  { id: 'bridge', label: 'JS to GPU Bridge' },
] as const;

function useActiveSection(scrollRef: React.RefObject<HTMLElement | null>) {
  const [activeId, setActiveId] = useState<string>(TOC_SECTIONS[0].id);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      {
        root: container,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      },
    );

    for (const { id } of TOC_SECTIONS) {
      const el = container.querySelector(`#${id}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [scrollRef]);

  return activeId;
}

/* ── Main Article ──────────────────────────────────── */

export function FlowFieldArticle() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeSection = useActiveSection(scrollRef);
  const { setActiveSection, setTocSections, scrollToSectionRef } = useChrome();

  const scrollTo = useCallback((id: string) => {
    const el = scrollRef.current?.querySelector(`#${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Register TOC sections with chrome context
  useEffect(() => {
    setTocSections([...TOC_SECTIONS]);
    return () => setTocSections([]);
  }, [setTocSections]);

  // Sync active section to chrome context (for the dock's TOC dropdown)
  useEffect(() => {
    setActiveSection(activeSection);
  }, [activeSection, setActiveSection]);

  // Register scroll-to function for the dock to call
  useEffect(() => {
    scrollToSectionRef.current = scrollTo;
    return () => { scrollToSectionRef.current = null; };
  }, [scrollTo, scrollToSectionRef]);

  return (
    <motion.div
      className="article-page"
      ref={scrollRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* ── Hero ── */}
      <header className="article-hero">
        <p className="article-hero-eyebrow">Deep Dive</p>
        <h1>How the Flow Field Works</h1>
        <p className="article-hero-lead">
          A thorough, beginner-friendly walk through every layer of the shader &mdash; from raw screen coordinates to the final pixel you see on screen.
        </p>
      </header>

      {/* ── Table of contents (fixed sidebar) ── */}
      <aside className="article-toc">
        <ul className="article-toc-list">
          {TOC_SECTIONS.map(({ id, label }) => (
            <li key={id} className="article-toc-item">
              <button
                className={`article-toc-link${activeSection === id ? ' active' : ''}`}
                onClick={() => scrollTo(id)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Article body ── */}
      <div className="article-body">

        {/* ────────────────────────────────────────── */}
        <span className="article-section-num">01</span>
        <h2 id="overview">The Big Picture</h2>

        <p>
          What you see on screen is not a video, not a pre-rendered animation, and not a 3D scene. It's a <strong>fragment shader</strong> &mdash; a tiny program that runs on your GPU and computes the color of every single pixel, independently, 60 times per second.
        </p>
        <p>
          There are no meshes, no 3D objects, no textures loaded from files. The entire visual is <strong>pure math</strong>: noise functions, trigonometry, and carefully layered transformations. The GPU runs this math on millions of pixels simultaneously, which is why it's fast enough to be real-time.
        </p>
        <p>
          The shader processes each pixel through a pipeline of stages. Each stage transforms or adds to the result, building up the final color layer by layer:
        </p>

        <div className="article-diagram">
          <PipelineDiagram />
        </div>

        <p>
          Each stage feeds into the next. Let's walk through them, starting from the very beginning.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">02</span>
        <h2 id="canvas">The Canvas: A Fullscreen Quad</h2>

        <p>
          Before the fragment shader can paint pixels, the GPU needs to know <em>where</em> to draw. In a typical 3D scene, you'd send triangles that form objects. Here, we send just <strong>two triangles that cover the entire screen</strong> &mdash; a "fullscreen quad."
        </p>
        <p>
          The <strong>vertex shader</strong> runs first. It takes the quad's corner positions (which range from -1 to 1 in "clip space") and converts them to <strong>UV coordinates</strong> &mdash; values from 0 to 1 that tell the fragment shader where each pixel is on screen:
        </p>

        <CodeBlock code={CODE_VERTEX} caption="Vertex shader &mdash; fullscreen-quad.vert" />

        <p>
          Line 5 is the key: <code className="c">a_pos * 0.5 + 0.5</code> maps the range [-1, 1] to [0, 1]. After this, the fragment shader receives <code className="c">vUv</code> where (0, 0) is the bottom-left corner and (1, 1) is the top-right.
        </p>

        <div className="article-callout">
          <p>
            <strong>Think of it this way:</strong> the vertex shader sets up the canvas. The fragment shader is the paintbrush &mdash; it decides the color at every point.
          </p>
        </div>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">03</span>
        <h2 id="coordinates">Coordinate Space</h2>

        <p>
          The fragment shader begins by setting up its coordinate system. Raw UV values go from 0 to 1, but we need to account for the screen's <strong>aspect ratio</strong> &mdash; otherwise a circle would look like an oval on a widescreen monitor.
        </p>

        <CodeBlock code={CODE_COORDS} caption="Coordinate setup &mdash; flow-field.glsl" />

        <p>
          Here's what each part does:
        </p>
        <ul>
          <li><strong>Aspect correction</strong> (line 3): Multiply the x coordinate by the aspect ratio so shapes stay proportional.</li>
          <li><strong>Camera rotation</strong> (line 9): Rotate all coordinates around the center using a 2D rotation matrix. The <code className="c">rot2d</code> function applies <code className="c">[cos, -sin; sin, cos]</code> multiplication.</li>
          <li><strong>Camera zoom</strong> (line 10): Divide by the zoom factor. A zoom of 0.5 means the coordinates spread out &mdash; you see more of the noise field. A zoom of 2 means you're zoomed in, seeing less but bigger.</li>
        </ul>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">04</span>
        <h2 id="noise">The Noise Foundation</h2>

        <h3>What is noise?</h3>
        <p>
          "Noise" in shaders isn't like TV static. It's <strong>smooth, continuous randomness</strong> &mdash; think of gently rolling hills rather than jagged spikes. If you sample the noise at position (2.0, 3.0), you get some value. If you sample at (2.001, 3.0), you get an <em>almost identical</em> value. This smoothness is what makes the output look organic instead of chaotic.
        </p>

        <h3>Simplex noise</h3>
        <p>
          This shader uses <strong>Simplex noise</strong>, invented by Ken Perlin in 2001 as an improvement over his original Perlin noise. It works in 3D: the x and y inputs map to position on screen, and the z input is time &mdash; which is what makes the pattern animate.
        </p>
        <p>
          The core idea: divide 3D space into <strong>simplex cells</strong> (tetrahedra in 3D, triangles in 2D). At each corner of the cell, assign a random gradient direction. Then blend those gradients smoothly based on how far the sample point is from each corner.
        </p>

        <CodeBlock code={CODE_SNOISE_SHORT} caption="Simplex noise &mdash; abbreviated" />

        <p>
          The function returns a value between <strong>-1 and 1</strong>. The actual implementation is ~40 lines of permutation tables and gradient math (based on the Ashima Arts / Stefan Gustavson reference implementation), but the output is simple: smooth, continuous, pseudo-random values.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">05</span>
        <h2 id="fbm">FBM: Adding Detail</h2>

        <p>
          A single layer of Simplex noise produces smooth, blobby shapes. That's useful but not very interesting. <strong>Fractional Brownian Motion</strong> (FBM) fixes this by stacking multiple layers of noise at increasing frequencies:
        </p>

        <CodeBlock code={CODE_FBM} caption="Fractional Brownian Motion" />

        <div className="article-breakout">
          <div className="article-diagram">
            <FbmDiagram />
            <p className="article-diagram-caption">
              Each octave adds higher frequency at lower amplitude. The sum produces multi-scale detail.
            </p>
          </div>
        </div>

        <p>
          Each iteration is called an <strong>octave</strong> (borrowed from music, where each octave doubles the frequency). The first octave provides the large, sweeping shapes. The second adds medium-scale variation. The third adds fine detail. And so on.
        </p>
        <p>
          The <code className="c">u_noiseOctaves</code> uniform controls how many layers to use. More octaves = more detail, but also more GPU work. The default is 1, which keeps it smooth and fast. Cranking it to 6 reveals intricate fractal-like texture.
        </p>

        <div className="article-callout">
          <p>
            <strong>Why 0.48 and 1.9?</strong> These "magic numbers" control how fast amplitude decays and frequency grows. A 0.48 decay gives each octave roughly half the influence of the previous one. A 1.9x frequency multiplier avoids exact doubling, which can produce visible grid artifacts.
          </p>
        </div>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">06</span>
        <h2 id="domain-warp">Domain Warping: The Magic</h2>

        <p>
          This is the single most important technique in the shader. <strong>Domain warping</strong> is what transforms bland noise blobs into the flowing, organic, fabric-like forms you see.
        </p>
        <p>
          The idea is deceptively simple: <strong>use noise to displace the input to noise</strong>. Instead of sampling noise at position P, you sample noise at P + noise(P). The noise values shift the lookup position, creating folds, swirls, and flowing patterns that look like they belong in nature.
        </p>

        <div className="article-breakout">
          <div className="article-diagram">
            <DomainWarpDiagram />
            <p className="article-diagram-caption">
              Regular grid vs. noise-displaced sampling. Each dot's position is shifted by noise, creating organic distortion.
            </p>
          </div>
        </div>

        <p>
          The shader implements this as a <strong>cascading chain</strong> of warp passes, controlled by the <code className="c">u_warpDepth</code> parameter:
        </p>

        <CodeBlock code={CODE_WARP} caption="Domain warping &mdash; cascading passes" />

        <h3>Depth 0: No warping</h3>
        <p>
          When <code className="c">warpDepth</code> is 0, the position <code className="c">wP</code> stays equal to <code className="c">p</code>. You get plain FBM noise &mdash; smooth blobs.
        </p>

        <h3>Depth 1: Single warp</h3>
        <p>
          Two FBM values (<code className="c">q1</code>, <code className="c">q2</code>) are sampled at the base position. These become x and y displacements: <code className="c">wP = p + strength * vec2(q1, q2)</code>. The noise field bends and flows.
        </p>

        <h3>Depth 2: Double warp</h3>
        <p>
          Now we sample <em>again</em> from the already-warped position to get <code className="c">r1</code> and <code className="c">r2</code>. These produce a new displacement. The result: more complex folds and deeper turbulence.
        </p>

        <h3>Depth 3: Triple warp</h3>
        <p>
          One more level. The effect becomes richly layered &mdash; intricate channels and branching forms emerge. This is where the visual starts to resemble marble, liquid metal, or geological formations.
        </p>

        <div className="article-callout">
          <p>
            <strong>Why the "magic" offset vectors?</strong> Values like <code className="c">vec2(5.2, 1.3)</code> and <code className="c">vec2(1.7, 9.2)</code> ensure that each noise sample uses a different region of the noise space. Without these offsets, <code className="c">q1</code> and <code className="c">q2</code> would produce identical values, and the warping would collapse into a single direction. The specific numbers don't matter much &mdash; what matters is that they're <em>different</em> from each other and not too small.
          </p>
        </div>

        <p>
          Each warp level also uses a slightly different time multiplier (<code className="c">ft * 0.6</code>, <code className="c">ft * 0.55</code>, <code className="c">ft * 0.45</code>...). This means the warp layers animate at different speeds, creating a sense of visual depth &mdash; like watching currents at different depths in water.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">07</span>
        <h2 id="mouse">Mouse Interaction</h2>

        <p>
          When you move your cursor over the experiment, the flow field responds. But it doesn't use a simple "push pixels outward" effect &mdash; that would look mechanical. Instead, the mouse <strong>injects additional noise-driven warp</strong> near the cursor, creating an organic disturbance that blends naturally with the existing flow.
        </p>

        <h3>The influence field</h3>
        <p>
          First, the shader calculates how close each pixel is to the cursor and creates a smooth falloff:
        </p>

        <CodeBlock code={CODE_MOUSE_INFLUENCE} caption="Mouse influence calculation" />

        <div className="article-breakout">
          <div className="article-diagram">
            <MouseDiagram />
            <p className="article-diagram-caption">
              Smooth radial falloff around the cursor. The trail lags behind, creating a ghost that follows with delay.
            </p>
          </div>
        </div>

        <p>
          The <code className="c">smoothstep</code> function is key: it creates a smooth transition from 1 (full influence) at the center to 0 (no influence) at the edge. The <code className="c">mouseSoftness</code> parameter controls how gradual that transition is.
        </p>
        <p>
          The <strong>trail position</strong> lags behind the actual cursor. It's calculated in JavaScript every frame: <code className="c">trailX += (mouse.x - trailX) * smoothing</code>. This exponential smoothing creates a ghost position that chases the cursor with a configurable delay.
        </p>

        <h3>Noise-driven displacement</h3>
        <p>
          Here's where it gets interesting. The mouse doesn't push pixels in a radial direction. Instead, it samples <em>noise at the pixel's position</em> and uses that as the displacement:
        </p>

        <CodeBlock code={CODE_MOUSE} caption="Mouse warp injection" />

        <p>
          The key insight: <code className="c">vec2(mw1, mw2)</code> is noise-driven, not radial. Every pixel near the cursor gets displaced in a <em>different</em> direction, based on the noise field at that position. This is what makes the mouse interaction feel organic rather than like a fisheye lens.
        </p>
        <p>
          The last line adds a directional bias based on cursor velocity &mdash; when you move the mouse quickly, the flow bends slightly in the direction of movement.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">08</span>
        <h2 id="color">Painting with Math: Color Mapping</h2>

        <p>
          At this point, we have warped noise values &mdash; numbers, not colors. Now we need to map those numbers to actual colors. The shader uses a <strong>4-color palette</strong> with sin-based blending:
        </p>

        <CodeBlock code={CODE_COLOR} caption="Color mapping &mdash; sin-based blending" />

        <div className="article-breakout">
          <div className="article-diagram">
            <ColorMixDiagram />
            <p className="article-diagram-caption">
              Two-stage blending: col1/col2 and col3/col4 mix separately, then combine into the final color.
            </p>
          </div>
        </div>

        <h3>Why sin()?</h3>
        <p>
          The <code className="c">sin()</code> function converts the noise value into a smoothly oscillating blend factor between 0 and 1. The <code className="c">* 0.5 + 0.5</code> shifts sin's output from [-1, 1] to [0, 1].
        </p>
        <p>
          Why not just use the noise value directly? Because noise varies slowly and gradually over large areas &mdash; you'd get broad, boring color regions. By pushing it through sin(), small changes in the noise value can swing the blend factor through its full range, creating <strong>richer color banding</strong> with more visual detail.
        </p>
        <p>
          The <code className="c">blendWidth</code> parameter controls how many oscillations you get: a small value means broad, gradual color transitions; a large value creates tight, ribboned bands.
        </p>

        <h3>The two-stage mix</h3>
        <p>
          The blending happens in two stages. First, <code className="c">col1</code> and <code className="c">col2</code> blend to form <code className="c">mixA</code>, and <code className="c">col3</code> and <code className="c">col4</code> blend to form <code className="c">mixB</code>. Then <code className="c">mixA</code> and <code className="c">mixB</code> blend together using a <em>different</em> noise-derived factor (<code className="c">v2</code>). This two-stage approach gives the palette much more variety than a simple linear gradient.
        </p>
        <p>
          Finally, a subtle <strong>accent color</strong> (a 50/50 mix of col2 and col3) is blended in at 15% strength using the warp field's average values. This adds organic variation that depends on the warping, not just the final noise.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">09</span>
        <h2 id="highlights">Highlights &amp; Folds</h2>

        <p>
          Look closely at the flow field and you'll see bright lines tracing the edges of the flowing forms &mdash; like light catching the ridges of folded fabric. These highlights are created by detecting where the noise field "folds":
        </p>

        <CodeBlock code={CODE_HIGHLIGHTS} caption="Fold detection and highlight blending" />

        <p>
          The math is elegant: where <code className="c">n1</code> and <code className="c">n2</code> are similar (flat regions), <code className="c">abs(n1 - n2)</code> is small &mdash; no highlight. Where they diverge sharply (at fold boundaries), the difference is large &mdash; a bright highlight appears.
        </p>
        <p>
          The <code className="c">pow(fold, 0.6)</code> exponent is below 1, which <em>boosts</em> the mid-range values and sharpens the transition from dark to bright. Without it, the highlights would be very faint. Two fold sources are used (final noise and initial warp noise) and combined with <code className="c">max()</code> to catch folds at every scale.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">10</span>
        <h2 id="vignette">Vignette</h2>

        <p>
          The flow field is infinite &mdash; it extends in all directions. The vignette is what <strong>contains</strong> it, fading the edges to the background color:
        </p>

        <CodeBlock code={CODE_VIGNETTE} caption="Rounded rectangle SDF vignette" />

        <p>
          This uses a <strong>signed distance field</strong> (SDF) for a rounded rectangle &mdash; a standard technique from Inigo Quilez's distance function library. The SDF returns a single number: negative inside the shape, zero on the boundary, positive outside. That distance feeds into <code className="c">smoothstep</code> to create the soft fade.
        </p>
        <p>
          The <code className="c">vignetteRound</code> parameter (0&ndash;100) controls the <strong>corner radius</strong>. At 100, the corner radius equals the vignette size &mdash; producing a circle. At 0, the corners are sharp &mdash; a pure rectangle. Values in between give a "squircle" shape. Because the SDF is computed in raw UV space (not aspect-corrected), the vignette shape adapts naturally to any screen ratio.
        </p>
        <p>
          The <code className="c">smoothstep(-soft, +soft, d)</code> centered at zero means the fade is symmetric around the shape boundary &mdash; it bleeds equally inward and outward. This is the same <code className="c">smoothstep</code> technique used for the mouse influence &mdash; it appears repeatedly throughout the shader as the go-to tool for creating soft boundaries.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">11</span>
        <h2 id="post-processing">Post-Processing</h2>

        <p>
          The color from the previous stages is nearly final, but three adjustments give it polish:
        </p>

        <CodeBlock code={CODE_POST} caption="Post-processing &mdash; saturation, contrast, grain" />

        <h3>Saturation</h3>
        <p>
          First, we calculate the <strong>luminance</strong> (perceived brightness) of the color. The weights <code className="c">(0.299, 0.587, 0.114)</code> aren't arbitrary &mdash; they reflect how the human eye perceives brightness: green appears much brighter than blue, and red falls in between. Mixing between the grayscale version and the full color gives us a saturation control.
        </p>

        <h3>Brightness &amp; Contrast</h3>
        <p>
          Brightness is a simple multiplication. Contrast works by scaling the color's distance from 0.5 (mid-gray): <code className="c">(color - 0.5) * contrast + 0.5</code>. A contrast of 1 does nothing. Above 1, darks get darker and brights get brighter. Below 1, everything flattens toward gray.
        </p>

        <h3>Film grain</h3>
        <p>
          The grain effect uses <strong>hash functions</strong> &mdash; fast pseudo-random number generators that return different values for different inputs but always the same value for the same input:
        </p>

        <CodeBlock code={CODE_HASH} caption="Hash function &mdash; Dave Hoskins" />

        <p>
          Three hash functions are sampled at different offsets and averaged. Using three instead of one avoids visible patterns (one hash can produce subtle line artifacts). The result is centered around zero (<code className="c">- 0.5</code>) so it both adds and subtracts from the color, creating a true grain look.
        </p>
        <p>
          The <code className="c">grainSpeed</code> parameter controls how fast the grain pattern updates. At 60, it changes every frame, creating a flickering film grain effect. At lower values, the grain pattern persists longer, creating a more static texture.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">12</span>
        <h2 id="bridge">The Bridge: JavaScript to GPU</h2>

        <p>
          Every parameter you tweak in the control panel &mdash; noise scale, warp strength, colors, grain amount &mdash; needs to travel from JavaScript into the shader. This happens through <strong>uniforms</strong>: values that the CPU writes to GPU memory every frame.
        </p>

        <CodeBlock code={CODE_UNIFORMS} caption="Uniform update &mdash; FlowFieldExperiment.ts" />

        <p>
          The flow works like this:
        </p>
        <ol>
          <li><strong>DialKit</strong> (the control panel library) renders sliders and color pickers. When you drag a slider, it updates a flat JavaScript object.</li>
          <li>Every frame, the <code className="c">updateUniforms</code> function reads that object and writes each value into a <strong>uniform buffer</strong> &mdash; a tightly packed block of binary data with GPU-specific alignment rules.</li>
          <li>The GPU reads this buffer at the start of each frame. In the shader, these show up as the <code className="c">u_*</code> variables you've seen throughout.</li>
        </ol>

        <div className="article-callout">
          <p>
            <strong>WebGPU vs WebGL:</strong> This project supports both. WebGPU uses a single structured uniform buffer (one block of memory with defined layout). WebGL uses individual <code className="c">gl.uniform1f</code> / <code className="c">gl.uniform3f</code> calls for each value. The shader logic is identical &mdash; only the data transport differs.
          </p>
        </div>

        <p>
          The render loop ties it all together: <code className="c">requestAnimationFrame</code> fires every frame, calls <code className="c">updateUniforms</code> with the current time, then submits a GPU command that draws the fullscreen quad and triggers the fragment shader for every pixel.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />

        <div className="article-summary">
          <h3>Wrapping Up</h3>
          <p>
            Every pixel you see is painted by a single fragment shader. No textures, no meshes, no pre-rendered frames. The visual complexity comes entirely from <strong>layered mathematical transformations</strong>:
          </p>
          <ul>
            <li>Simplex noise provides the raw material &mdash; smooth, continuous randomness.</li>
            <li>FBM stacks noise at multiple frequencies for multi-scale detail.</li>
            <li>Domain warping feeds noise into noise, creating organic folds and flow.</li>
            <li>Sin-based color blending maps abstract numbers to a rich 4-color palette.</li>
            <li>Fold detection finds the edges where the field diverges, adding highlights.</li>
            <li>Post-processing applies saturation, contrast, and film grain for polish.</li>
          </ul>
          <p>
            Every one of these stages is controlled by a uniform &mdash; a number you can change in real time. The shader is a machine with <strong>40+ knobs</strong>, each affecting a different aspect of the final image. The control panel lets you turn every one of them.
          </p>
        </div>

      {/* close article-body */}
      </div>
    </motion.div>
  );
}
